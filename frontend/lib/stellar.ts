import { requestAccess, signTransaction } from '@stellar/freighter-api';
import {
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk';

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const COURSE_PAYMENT = process.env.NEXT_PUBLIC_COURSE_PAYMENT_CONTRACT_ID ?? '';

export const contractsConfigured = Boolean(COURSE_PAYMENT);

export async function connectWallet(): Promise<string> {
  const res = await requestAccess();
  if (res.error) throw new Error(res.error.message ?? 'Freighter access denied');
  return res.address;
}

const server = () => new rpc.Server(RPC_URL);

/** Buy a course: calls course_payment.purchase(learner, course_id), signed in Freighter. */
export async function buyCourse(learner: string, courseId: number): Promise<string> {
  if (!COURSE_PAYMENT) throw new Error('Set NEXT_PUBLIC_COURSE_PAYMENT_CONTRACT_ID in .env.local');
  const s = server();
  const account = await s.getAccount(learner);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(
      new Contract(COURSE_PAYMENT).call(
        'purchase',
        nativeToScVal(learner, { type: 'address' }),
        nativeToScVal(courseId, { type: 'u32' }),
      ),
    )
    .setTimeout(60)
    .build();

  const prepared = await s.prepareTransaction(tx);
  const signed = await signTransaction(prepared.toXDR(), {
    networkPassphrase: PASSPHRASE,
    address: learner,
  });
  if (signed.error) throw new Error(signed.error.message ?? 'Signing rejected');

  const sent = await s.sendTransaction(TransactionBuilder.fromXDR(signed.signedTxXdr, PASSPHRASE));
  if (sent.status === 'ERROR') throw new Error('Transaction rejected');

  // Wait for confirmation.
  for (let i = 0; i < 20; i++) {
    const r = await s.getTransaction(sent.hash);
    if (r.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash;
    if (r.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error('Purchase failed on-chain');
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error('Timed out waiting for confirmation');
}

/** Read-only check: course_payment.has_access(course_id, learner). */
export async function hasAccess(learner: string, courseId: number): Promise<boolean> {
  if (!COURSE_PAYMENT) return true; // dev mode: everything unlocked
  const s = server();
  const account = await s.getAccount(learner);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(
      new Contract(COURSE_PAYMENT).call(
        'has_access',
        nativeToScVal(courseId, { type: 'u32' }),
        nativeToScVal(learner, { type: 'address' }),
      ),
    )
    .setTimeout(30)
    .build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationSuccess(sim) && sim.result) return Boolean(scValToNative(sim.result.retval));
  return false;
}
