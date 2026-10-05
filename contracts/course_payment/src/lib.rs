#![no_std]
//! # Tempo — Course Payment contract
//!
//! Handles the money side of the marketplace:
//! 1. Instructors list a course with a price and optional co-author splits.
//! 2. Learners buy a course; funds are held in **escrow** for a refund window.
//! 3. Inside the window, a learner who hasn't gone past lesson 2 can get a full refund.
//! 4. After the window, anyone can call `release` to pay the platform fee,
//!    co-authors and the instructor in a single transaction.
//!
//! Lesson progress is reported by a trusted `oracle` (the Tempo backend).

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env, Vec};

mod test;

/// 7 days, in seconds.
pub const REFUND_WINDOW_SECS: u64 = 7 * 24 * 60 * 60;
/// Learners can refund only while they've completed fewer lessons than this.
pub const MAX_LESSONS_FOR_REFUND: u32 = 2;
/// Basis points denominator (10_000 = 100%).
pub const BPS_DENOM: u32 = 10_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidPrice = 3,
    InvalidSplits = 4,
    CourseNotFound = 5,
    CourseInactive = 6,
    AlreadyPurchased = 7,
    PurchaseNotFound = 8,
    RefundWindowClosed = 9,
    TooMuchProgress = 10,
    AlreadySettled = 11,
    RefundWindowOpen = 12,
    InvalidFee = 13,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    /// Payment asset, e.g. the USDC Stellar Asset Contract.
    pub token: Address,
    /// Receives the platform fee.
    pub treasury: Address,
    pub platform_fee_bps: u32,
    /// Backend account allowed to report lesson progress.
    pub oracle: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Split {
    pub recipient: Address,
    /// Share of the post-fee amount, in basis points.
    pub bps: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Course {
    pub id: u32,
    pub instructor: Address,
    pub price: i128,
    /// Co-authors / backing-track creators. Instructor gets the remainder.
    pub splits: Vec<Split>,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PurchaseStatus {
    Escrowed,
    Refunded,
    Released,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Purchase {
    pub amount: i128,
    pub paid_at: u64,
    pub lessons_completed: u32,
    pub status: PurchaseStatus,
}

#[contracttype]
pub enum DataKey {
    Config,
    NextCourseId,
    Course(u32),
    Purchase(u32, Address),
}

#[contract]
pub struct CoursePayment;

#[contractimpl]
impl CoursePayment {
    // ---------------------------------------------------------------- admin

    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        treasury: Address,
        platform_fee_bps: u32,
        oracle: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }
        if platform_fee_bps > BPS_DENOM {
            return Err(Error::InvalidFee);
        }
        admin.require_auth();
        let cfg = Config {
            admin,
            token,
            treasury,
            platform_fee_bps,
            oracle,
        };
        env.storage().instance().set(&DataKey::Config, &cfg);
        env.storage().instance().set(&DataKey::NextCourseId, &1u32);
        Ok(())
    }

    pub fn config(env: Env) -> Result<Config, Error> {
        load_config(&env)
    }

    // ------------------------------------------------------------ instructors

    /// List a new course. Returns its id.
    pub fn create_course(
        env: Env,
        instructor: Address,
        price: i128,
        splits: Vec<Split>,
    ) -> Result<u32, Error> {
        load_config(&env)?;
        instructor.require_auth();
        if price <= 0 {
            return Err(Error::InvalidPrice);
        }
        validate_splits(&splits)?;

        let id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextCourseId)
            .unwrap_or(1);
        let course = Course {
            id,
            instructor,
            price,
            splits,
            active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Course(id), &course);
        env.storage()
            .instance()
            .set(&DataKey::NextCourseId, &(id + 1));
        Ok(id)
    }

    /// Instructor can change price or pause sales. Existing purchases are unaffected.
    pub fn update_course(env: Env, course_id: u32, price: i128, active: bool) -> Result<(), Error> {
        let mut course = load_course(&env, course_id)?;
        course.instructor.require_auth();
        if price <= 0 {
            return Err(Error::InvalidPrice);
        }
        course.price = price;
        course.active = active;
        env.storage()
            .persistent()
            .set(&DataKey::Course(course_id), &course);
        Ok(())
    }

    pub fn get_course(env: Env, course_id: u32) -> Result<Course, Error> {
        load_course(&env, course_id)
    }

    // --------------------------------------------------------------- learners

    /// Buy a course. Funds move from the learner into this contract (escrow).
    pub fn purchase(env: Env, learner: Address, course_id: u32) -> Result<(), Error> {
        let cfg = load_config(&env)?;
        learner.require_auth();
        let course = load_course(&env, course_id)?;
        if !course.active {
            return Err(Error::CourseInactive);
        }
        let key = DataKey::Purchase(course_id, learner.clone());
        if let Some(p) = env.storage().persistent().get::<_, Purchase>(&key) {
            // Allow re-buying only after a refund.
            if p.status != PurchaseStatus::Refunded {
                return Err(Error::AlreadyPurchased);
            }
        }

        token::Client::new(&env, &cfg.token).transfer(
            &learner,
            &env.current_contract_address(),
            &course.price,
        );

        let purchase = Purchase {
            amount: course.price,
            paid_at: env.ledger().timestamp(),
            lessons_completed: 0,
            status: PurchaseStatus::Escrowed,
        };
        env.storage().persistent().set(&key, &purchase);
        Ok(())
    }

    /// Full refund while inside the window and before lesson `MAX_LESSONS_FOR_REFUND`.
    pub fn refund(env: Env, learner: Address, course_id: u32) -> Result<i128, Error> {
        let cfg = load_config(&env)?;
        learner.require_auth();
        let key = DataKey::Purchase(course_id, learner.clone());
        let mut p = load_purchase(&env, &key)?;

        if p.status != PurchaseStatus::Escrowed {
            return Err(Error::AlreadySettled);
        }
        if env.ledger().timestamp() >= p.paid_at + REFUND_WINDOW_SECS {
            return Err(Error::RefundWindowClosed);
        }
        if p.lessons_completed >= MAX_LESSONS_FOR_REFUND {
            return Err(Error::TooMuchProgress);
        }

        token::Client::new(&env, &cfg.token).transfer(
            &env.current_contract_address(),
            &learner,
            &p.amount,
        );
        p.status = PurchaseStatus::Refunded;
        env.storage().persistent().set(&key, &p);
        Ok(p.amount)
    }

    pub fn get_purchase(env: Env, course_id: u32, learner: Address) -> Option<Purchase> {
        env.storage()
            .persistent()
            .get(&DataKey::Purchase(course_id, learner))
    }

    /// True if the learner owns the course (escrowed or released, not refunded).
    pub fn has_access(env: Env, course_id: u32, learner: Address) -> bool {
        match env
            .storage()
            .persistent()
            .get::<_, Purchase>(&DataKey::Purchase(course_id, learner))
        {
            Some(p) => p.status != PurchaseStatus::Refunded,
            None => false,
        }
    }

    // ----------------------------------------------------------------- oracle

    /// Backend reports how many lessons the learner has completed.
    /// Progress only moves forward.
    pub fn report_progress(
        env: Env,
        course_id: u32,
        learner: Address,
        lessons_completed: u32,
    ) -> Result<(), Error> {
        let cfg = load_config(&env)?;
        cfg.oracle.require_auth();
        let key = DataKey::Purchase(course_id, learner);
        let mut p = load_purchase(&env, &key)?;
        if lessons_completed > p.lessons_completed {
            p.lessons_completed = lessons_completed;
            env.storage().persistent().set(&key, &p);
        }
        Ok(())
    }

    // ------------------------------------------------------------- settlement

    /// After the refund window, pay out fee, co-authors and instructor.
    /// Permissionless: anyone (usually the backend or the instructor) can call it.
    pub fn release(env: Env, course_id: u32, learner: Address) -> Result<(), Error> {
        let cfg = load_config(&env)?;
        let course = load_course(&env, course_id)?;
        let key = DataKey::Purchase(course_id, learner);
        let mut p = load_purchase(&env, &key)?;

        if p.status != PurchaseStatus::Escrowed {
            return Err(Error::AlreadySettled);
        }
        if env.ledger().timestamp() < p.paid_at + REFUND_WINDOW_SECS {
            return Err(Error::RefundWindowOpen);
        }

        let tok = token::Client::new(&env, &cfg.token);
        let me = env.current_contract_address();

        let fee = p.amount * cfg.platform_fee_bps as i128 / BPS_DENOM as i128;
        let net = p.amount - fee;
        if fee > 0 {
            tok.transfer(&me, &cfg.treasury, &fee);
        }

        let mut paid_to_splits: i128 = 0;
        for s in course.splits.iter() {
            let share = net * s.bps as i128 / BPS_DENOM as i128;
            if share > 0 {
                tok.transfer(&me, &s.recipient, &share);
                paid_to_splits += share;
            }
        }
        // Instructor receives the remainder (also absorbs rounding dust).
        let instructor_share = net - paid_to_splits;
        if instructor_share > 0 {
            tok.transfer(&me, &course.instructor, &instructor_share);
        }

        p.status = PurchaseStatus::Released;
        env.storage().persistent().set(&key, &p);
        Ok(())
    }
}

// ------------------------------------------------------------------ helpers

fn load_config(env: &Env) -> Result<Config, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .ok_or(Error::NotInitialized)
}

fn load_course(env: &Env, id: u32) -> Result<Course, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Course(id))
        .ok_or(Error::CourseNotFound)
}

fn load_purchase(env: &Env, key: &DataKey) -> Result<Purchase, Error> {
    env.storage()
        .persistent()
        .get(key)
        .ok_or(Error::PurchaseNotFound)
}

fn validate_splits(splits: &Vec<Split>) -> Result<(), Error> {
    let mut total: u32 = 0;
    for s in splits.iter() {
        if s.bps == 0 {
            return Err(Error::InvalidSplits);
        }
        total = total.checked_add(s.bps).ok_or(Error::InvalidSplits)?;
    }
    if total > BPS_DENOM {
        return Err(Error::InvalidSplits);
    }
    Ok(())
}
