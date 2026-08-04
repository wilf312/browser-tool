/** Unmount whatever a test rendered, so the next one starts on an empty page. */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);
