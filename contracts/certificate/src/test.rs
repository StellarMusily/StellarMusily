#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup<'a>() -> (Env, CertificateContractClient<'a>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let id = env.register(CertificateContract, ());
    let client = CertificateContractClient::new(&env, &id);
    client.init(&admin, &issuer);
    let learner = Address::generate(&env);
    (env, client, learner)
}

#[test]
fn issue_and_verify() {
    let (env, c, learner) = setup();
    let id = c.issue(
        &learner,
        &1,
        &String::from_str(&env, "Beginner Guitar"),
        &String::from_str(&env, "guitar"),
        &92,
    );
    assert_eq!(id, 1);
    assert!(c.verify(&learner, &1));
    assert!(!c.verify(&learner, &2));
    assert_eq!(c.certificates_of(&learner).len(), 1);
    assert_eq!(c.get(&id).score, 92);
}

#[test]
fn one_certificate_per_course() {
    let (env, c, learner) = setup();
    let t = String::from_str(&env, "Piano Basics");
    let i = String::from_str(&env, "piano");
    c.issue(&learner, &3, &t, &i, &80);
    assert_eq!(
        c.try_issue(&learner, &3, &t, &i, &80),
        Err(Ok(Error::AlreadyCertified))
    );
}

#[test]
fn revoked_certificate_fails_verification() {
    let (env, c, learner) = setup();
    let id = c.issue(
        &learner,
        &1,
        &String::from_str(&env, "Talking Drum 101"),
        &String::from_str(&env, "talking drum"),
        &75,
    );
    c.revoke(&id);
    assert!(!c.verify(&learner, &1));
    assert!(c.get(&id).revoked);
}
