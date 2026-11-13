import { createAction4 } from './action4.js';

// Add products here; each factory returns the same group + parts contract.
export const products = {
  'action-4': {
    name: 'DJI Osmo Action 4',
    create: createAction4,
    sources: ['https://www.dji.com/osmo-action-4/specs', 'https://www.dji.com/osmo-action-4/faq'],
  },
};
