#![no_std]
//! # Tempo — Certificate contract
//!
//! Issues **non-transferable** completion certificates. There is deliberately no
//! `transfer` function: a certificate stays with the learner who earned it.
//! Anyone (schools, gig platforms, employers) can verify one on-chain.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, String, Vec};

mod test;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    AlreadyCertified = 3,
    NotFound = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Certificate {
    pub id: u32,
    pub owner: Address,
    pub course_id: u32,
    pub course_title: String,
    pub instrument: String,
    /// Final practice-challenge score, 0–100.
    pub score: u32,
    pub issued_at: u64,
    pub revoked: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Issuer,
    NextId,
    Cert(u32),
    Owned(Address),
    ByCourse(Address, u32),
}

#[contract]
pub struct CertificateContract;

#[contractimpl]
impl CertificateContract {
    /// `issuer` is the Tempo backend that verifies course completion.
    pub fn init(env: Env, admin: Address, issuer: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Issuer, &issuer);
        env.storage().instance().set(&DataKey::NextId, &1u32);
        Ok(())
    }

    pub fn set_issuer(env: Env, issuer: Address) -> Result<(), Error> {
        admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Issuer, &issuer);
        Ok(())
    }

    /// Mint a certificate. One per learner per course.
    pub fn issue(
        env: Env,
        owner: Address,
        course_id: u32,
        course_title: String,
        instrument: String,
        score: u32,
    ) -> Result<u32, Error> {
        let issuer: Address = env
            .storage()
            .instance()
            .get(&DataKey::Issuer)
            .ok_or(Error::NotInitialized)?;
        issuer.require_auth();

        let by_course = DataKey::ByCourse(owner.clone(), course_id);
        if env.storage().persistent().has(&by_course) {
            return Err(Error::AlreadyCertified);
        }

        let id: u32 = env.storage().instance().get(&DataKey::NextId).unwrap_or(1);
        let cert = Certificate {
            id,
            owner: owner.clone(),
            course_id,
            course_title,
            instrument,
            score: score.min(100),
            issued_at: env.ledger().timestamp(),
            revoked: false,
        };
        env.storage().persistent().set(&DataKey::Cert(id), &cert);
        env.storage().persistent().set(&by_course, &id);

        let owned_key = DataKey::Owned(owner);
        let mut owned: Vec<u32> = env
            .storage()
            .persistent()
            .get(&owned_key)
            .unwrap_or(Vec::new(&env));
        owned.push_back(id);
        env.storage().persistent().set(&owned_key, &owned);

        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        Ok(id)
    }

    /// Admin can revoke a certificate (e.g. proven cheating). It stays visible as revoked.
    pub fn revoke(env: Env, id: u32) -> Result<(), Error> {
        admin(&env)?.require_auth();
        let key = DataKey::Cert(id);
        let mut cert: Certificate = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NotFound)?;
        cert.revoked = true;
        env.storage().persistent().set(&key, &cert);
        Ok(())
    }

    pub fn get(env: Env, id: u32) -> Result<Certificate, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Cert(id))
            .ok_or(Error::NotFound)
    }

    pub fn certificates_of(env: Env, owner: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::Owned(owner))
            .unwrap_or(Vec::new(&env))
    }

    /// Quick verification: does `owner` hold a valid certificate for `course_id`?
    pub fn verify(env: Env, owner: Address, course_id: u32) -> bool {
        let id: Option<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::ByCourse(owner, course_id));
        match id {
            Some(id) => env
                .storage()
                .persistent()
                .get::<_, Certificate>(&DataKey::Cert(id))
                .map(|c| !c.revoked)
                .unwrap_or(false),
            None => false,
        }
    }
}

fn admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)
}
