/** Entry point of the settings page (used both as the options page and the popup). */

import { createRoot } from 'react-dom/client';
import { App } from './App';
import './options.css';

const container = document.getElementById('root');
if (container) createRoot(container).render(<App />);
