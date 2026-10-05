#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env,
};

struct Setup<'a> {
    env: Env,
    client: CoursePaymentClient<'a>,
    token: TokenClient<'a>,
    treasury: Address,
    oracle: Address,
    instructor: Address,
    coauthor: Address,
    learner: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let oracle = Address::generate(&env);
    let instructor = Address::generate(&env);
    let coauthor = Address::generate(&env);
    let learner = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = TokenClient::new(&env, &sac.address());
    StellarAssetClient::new(&env, &sac.address()).mint(&learner, &1_000_0000000);

    let id = env.register(CoursePayment, ());
    let client = CoursePaymentClient::new(&env, &id);
    // 10% platform fee
    client.init(&admin, &sac.address(), &treasury, &1_000, &oracle);

    Setup {
        env,
        client,
        token,
        treasury,
        oracle,
        instructor,
        coauthor,
        learner,
    }
}

fn list_course(s: &Setup) -> u32 {
    // Co-author gets 20% of the post-fee amount.
    let splits = vec![
        &s.env,
        Split {
            recipient: s.coauthor.clone(),
            bps: 2_000,
        },
    ];
    s.client.create_course(&s.instructor, &100_0000000, &splits)
}

#[test]
fn purchase_escrows_funds() {
    let s = setup();
    let c = list_course(&s);
    s.client.purchase(&s.learner, &c);

    assert_eq!(s.token.balance(&s.client.address), 100_0000000);
    assert!(s.client.has_access(&c, &s.learner));
}

#[test]
fn refund_inside_window() {
    let s = setup();
    let c = list_course(&s);
    s.client.purchase(&s.learner, &c);
    s.client.report_progress(&c, &s.learner, &1);

    let refunded = s.client.refund(&s.learner, &c);
    assert_eq!(refunded, 100_0000000);
    assert_eq!(s.token.balance(&s.learner), 1_000_0000000);
    assert!(!s.client.has_access(&c, &s.learner));
}

#[test]
fn no_refund_after_lesson_two() {
    let s = setup();
    let c = list_course(&s);
    s.client.purchase(&s.learner, &c);
    s.client.report_progress(&c, &s.learner, &2);

    let res = s.client.try_refund(&s.learner, &c);
    assert_eq!(res, Err(Ok(Error::TooMuchProgress)));
}

#[test]
fn no_refund_after_window() {
    let s = setup();
    let c = list_course(&s);
    s.client.purchase(&s.learner, &c);
    s.env
        .ledger()
        .with_mut(|l| l.timestamp += REFUND_WINDOW_SECS);

    let res = s.client.try_refund(&s.learner, &c);
    assert_eq!(res, Err(Ok(Error::RefundWindowClosed)));
}

#[test]
fn release_splits_payment() {
    let s = setup();
    let c = list_course(&s);
    s.client.purchase(&s.learner, &c);

    // Can't release early.
    assert_eq!(
        s.client.try_release(&c, &s.learner),
        Err(Ok(Error::RefundWindowOpen))
    );

    s.env
        .ledger()
        .with_mut(|l| l.timestamp += REFUND_WINDOW_SECS);
    s.client.release(&c, &s.learner);

    // 100 → 10 fee, 90 net → 18 co-author, 72 instructor
    assert_eq!(s.token.balance(&s.treasury), 10_0000000);
    assert_eq!(s.token.balance(&s.coauthor), 18_0000000);
    assert_eq!(s.token.balance(&s.instructor), 72_0000000);
    assert_eq!(s.token.balance(&s.client.address), 0);
    assert!(s.client.has_access(&c, &s.learner));

    // Can't release twice.
    assert_eq!(
        s.client.try_release(&c, &s.learner),
        Err(Ok(Error::AlreadySettled))
    );
}

#[test]
fn cannot_buy_twice() {
    let s = setup();
    let c = list_course(&s);
    s.client.purchase(&s.learner, &c);
    assert_eq!(
        s.client.try_purchase(&s.learner, &c),
        Err(Ok(Error::AlreadyPurchased))
    );
}

#[test]
fn rejects_splits_over_100_percent() {
    let s = setup();
    let splits = vec![
        &s.env,
        Split {
            recipient: s.coauthor.clone(),
            bps: 6_000,
        },
        Split {
            recipient: s.oracle.clone(),
            bps: 5_000,
        },
    ];
    let res = s.client.try_create_course(&s.instructor, &100, &splits);
    assert_eq!(res, Err(Ok(Error::InvalidSplits)));
}
