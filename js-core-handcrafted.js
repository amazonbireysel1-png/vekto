// Elle tasarlanmış öğretici bölümler.
// Her ok, kuyruktan başa [x, y] noktalarıyla verilir; baş yönü son parçanın yönüdür.

import { DX, DY } from './js-core-rules.js';

export const HANDCRAFTED = {
  1: {
    w: 6, h: 6, tutorial: 'basics',
    snakes: [
      [[1, 1], [2, 1], [3, 1]],
      [[4, 4], [4, 3]],
      [[2, 3], [2, 4], [2, 5]],
    ],
  },
  2: {
    w: 6, h: 6, tutorial: 'order',
    snakes: [
      [[0, 2], [1, 2], [2, 2]],
      [[4, 4], [4, 3], [4, 2], [4, 1]],
      [[1, 5], [1, 4]],
      [[5, 5], [4, 5], [3, 5], [3, 4]],
    ],
  },
  3: {
    w: 7, h: 7, tutorial: 'plan',
    snakes: [
      [[1, 0], [1, 1], [2, 1], [3, 1], [4, 1]],
      [[5, 3], [5, 2], [5, 1], [5, 0]],
      [[6, 5], [5, 5], [4, 5], [3, 5], [3, 4], [3, 3]],
      [[0, 3], [1, 3], [2, 3]],
      [[0, 6], [1, 6], [2, 6], [2, 5]],
      [[6, 2], [6, 3], [6, 4]],
    ],
  },
};

export function parseHandcrafted(spec) {
  const { w, h } = spec;
  const snakes = spec.snakes.map((pts) => {
    const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1];
    let d = 0;
    for (let k = 0; k < 4; k++) if (DX[k] === bx - ax && DY[k] === by - ay) d = k;
    return { cells: pts.map(([x, y]) => y * w + x), d };
  });
  return { w, h, mask: new Uint8Array(w * h).fill(1), snakes };
}
