import type { ProgramPreset } from '../types';
import { LINEAR_5X5 } from './linear5x5';
import { REDDIT_PPL } from './redditPpl';
import { GZCLP } from './gzclp';
import { PHUL } from './phul';
import { PHAT } from './phat';

export const ALL_PRESETS: ProgramPreset[] = [LINEAR_5X5, REDDIT_PPL, GZCLP, PHUL, PHAT];

export { LINEAR_5X5, REDDIT_PPL, GZCLP, PHUL, PHAT };
