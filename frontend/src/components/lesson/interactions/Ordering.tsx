import { useMemo, useState } from 'react';
import type { OrderingConfig, OrderingItem } from '../../../content';
import type { AnswerStatus } from '../FeedbackRenderer';
import './Ordering.css';

type OrderingProps = {
  config: OrderingConfig;
  disabled?: boolean;
  onResult: (status: AnswerStatus) => void;
};

// A stable seed from the item ids so the shuffle is deterministic across
// renders (no flicker, no re-shuffle on state change) yet varies per question.
function seedFromItems(items: OrderingItem[]): number {
  let seed = 0;
  for (const item of items) {
    for (let index = 0; index < item.id.length; index += 1) {
      seed = (seed * 31 + item.id.charCodeAt(index)) % 2147483647;
    }
  }
  return (seed % 2147483646) + 1;
}

// Deterministic shuffle that is guaranteed never to equal the correct order, so
// the learner always has real work to do on first render.
function shuffledInitialOrder(items: OrderingItem[], correctIds: string[]): OrderingItem[] {
  const shuffled = [...items];
  if (shuffled.length < 2) return shuffled;

  let seed = seedFromItems(items);
  const nextRandom = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(nextRandom() * (index + 1));
    [shuffled[index], shuffled[swapWith]] = [shuffled[swapWith], shuffled[index]];
  }

  if (shuffled.every((item, index) => item.id === correctIds[index])) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled;
}

export function Ordering({ config, disabled = false, onResult }: OrderingProps) {
  const correctIds = useMemo(
    () => config.correctOrder ?? config.items.map((item) => item.id),
    [config],
  );
  const [order, setOrder] = useState<OrderingItem[]>(() =>
    shuffledInitialOrder(config.items, correctIds),
  );

  function move(index: number, direction: -1 | 1) {
    if (disabled) return;
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function check() {
    if (disabled) return;
    const isCorrect = order.every((item, index) => item.id === correctIds[index]);
    onResult(isCorrect ? 'correct' : 'wrong');
  }

  return (
    <div className="cci-order">
      <ol className="cci-order-list">
        {order.map((item, index) => (
          <li className="cci-order-row" data-cci-order-id={item.id} key={item.id}>
            <span className="cci-order-rank" aria-hidden="true">
              {index + 1}
            </span>
            <span className="cci-order-label">{item.label}</span>
            <span className="cci-order-controls">
              <button
                type="button"
                className="cci-order-move"
                aria-label={`Move ${item.label} up`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                <span aria-hidden="true">↑</span>
              </button>
              <button
                type="button"
                className="cci-order-move"
                aria-label={`Move ${item.label} down`}
                disabled={disabled || index === order.length - 1}
                onClick={() => move(index, 1)}
              >
                <span aria-hidden="true">↓</span>
              </button>
            </span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="secondary-button cci-order-check"
        disabled={disabled}
        onClick={check}
      >
        Check order
      </button>
    </div>
  );
}
