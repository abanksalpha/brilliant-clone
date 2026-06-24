import { describe, expect, it, vi } from 'vitest';
import { otherParticipant, pairId, partitionFriendships, relationshipFor, sortedPair } from './friendsStore';
import type { Friendship } from './types';

// Keep Firestore out of these pure-helper tests.
vi.mock('../lib/firebase', () => ({ db: null }));

function friendship(participants: [string, string], status: 'pending' | 'accepted', requestedBy: string): Friendship {
  return { pairId: pairId(participants[0], participants[1]), participants, status, requestedBy };
}

describe('pairId / sortedPair', () => {
  it('produces a canonical, order-independent id', () => {
    expect(pairId('alice', 'bob')).toBe('alice_bob');
    expect(pairId('bob', 'alice')).toBe('alice_bob');
    expect(pairId('bob', 'alice')).toBe(pairId('alice', 'bob'));
  });

  it('sorts the pair ascending', () => {
    expect(sortedPair('bob', 'alice')).toEqual(['alice', 'bob']);
    expect(sortedPair('alice', 'bob')).toEqual(['alice', 'bob']);
  });
});

describe('partitionFriendships', () => {
  const me = 'me';
  const friendships: Friendship[] = [
    friendship(['me', 'zoe'], 'accepted', 'me'),
    friendship(['ann', 'me'], 'pending', 'ann'), // incoming (someone asked me)
    friendship(['me', 'sam'], 'pending', 'me'), // outgoing (I asked someone)
    friendship(['a', 'b'], 'accepted', 'a'), // unrelated to me
  ];

  it('splits accepted friends, incoming, and outgoing, ignoring unrelated docs', () => {
    const { friendIds, incomingIds, outgoingIds } = partitionFriendships(friendships, me);
    expect(friendIds).toEqual(['zoe']);
    expect(incomingIds).toEqual(['ann']);
    expect(outgoingIds).toEqual(['sam']);
  });
});

describe('relationshipFor', () => {
  const me = 'me';
  const partitioned = { friendIds: ['zoe'], incomingIds: ['ann'], outgoingIds: ['sam'] };

  it('classifies the relationship of another user to me', () => {
    expect(relationshipFor('me', partitioned, me)).toBe('self');
    expect(relationshipFor('zoe', partitioned, me)).toBe('friends');
    expect(relationshipFor('ann', partitioned, me)).toBe('incoming');
    expect(relationshipFor('sam', partitioned, me)).toBe('outgoing');
    expect(relationshipFor('nobody', partitioned, me)).toBe('none');
  });
});

describe('otherParticipant', () => {
  it('returns the participant that is not me, regardless of order', () => {
    expect(otherParticipant(friendship(['me', 'zoe'], 'accepted', 'me'), 'me')).toBe('zoe');
    expect(otherParticipant(friendship(['ann', 'me'], 'pending', 'ann'), 'me')).toBe('ann');
  });
});
