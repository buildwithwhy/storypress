import React from 'react';
import {createRoot} from 'react-dom/client';
import Storypress from './storypress';
import {captureGrowthEntry} from '../lib/growth';
// Before any sign-in or checkout return rewrites the URL (docs/GROWTH-ENGINE.md).
captureGrowthEntry();
createRoot(document.getElementById('root')!).render(<Storypress/>);
