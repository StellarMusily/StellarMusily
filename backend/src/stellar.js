// Bridge to the Soroban contracts. The backend acts as:
//  - the `oracle` of course_payment (reports lesson progress, which locks refunds)
//  - the `issuer` of certificate (mints a certificate when a course is completed)
//
// If ORACLE_SECRET or contract ids are missing, calls are logged instead of sent,
// so the app runs locally without any Stellar setup.

import {
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk';

const {
  STELLAR_RPC_URL = 'https://soroban-testnet.stellar.org',
  STELLAR_NETWORK = 'testnet',
  ORACLE_SECRET,
  COURSE_PAYMENT_CONTRACT_ID,
  CERTIFICATE_CONTRACT_ID,
} = process.env;

const passphrase = STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const enabled = Boolean(ORACLE_SECRET && COURSE_PAYMENT_CONTRACT_ID && CERTIFICATE_CONTRACT_ID);

async function invoke(contractId, method, args) {
  if (!enabled) {
    console.log(`[stellar:dry-run] ${method}`, args.map(String));
    return { dryRun: true };
  }
  const server = new rpc.Server(STELLAR_RPC_URL);
  const kp = Keypair.fromSecret(ORACLE_SECRET);
  const account = await server.getAccount(kp.publicKey());

  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: passphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(kp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') throw new Error(`${method} failed: ${JSON.stringify(sent.errorResult)}`);
  return { hash: sent.hash };
}

const addr = (a) => nativeToScVal(a, { type: 'address' });
const u32 = (n) => nativeToScVal(n, { type: 'u32' });
const str = (s) => nativeToScVal(s, { type: 'string' });

export function reportProgress(courseId, learner, lessonsCompleted) {
  return invoke(COURSE_PAYMENT_CONTRACT_ID, 'report_progress', [
    u32(courseId),
    addr(learner),
    u32(lessonsCompleted),
  ]);
}

export function issueCertificate(learner, course, score) {
  return invoke(CERTIFICATE_CONTRACT_ID, 'issue', [
    addr(learner),
    u32(course.id),
    str(course.title),
    str(course.instrument),
    u32(Math.round(score)),
  ]);
}

export const stellarEnabled = enabled;
