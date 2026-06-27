import { getFirestore } from 'firebase-admin/firestore';
import type { ProblemKey } from './types';

const COLLECTION = 'synthesisProblems';

export async function saveSynthesisProblem(key: ProblemKey): Promise<void> {
  await getFirestore().collection(COLLECTION).doc(key.problemId).set(key);
}

export async function getSynthesisKey(problemId: string): Promise<ProblemKey | null> {
  const snap = await getFirestore().collection(COLLECTION).doc(problemId).get();
  return snap.exists ? (snap.data() as ProblemKey) : null;
}
