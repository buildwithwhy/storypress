import {artworkPath} from './artwork';
import {type Story} from './story';
// Only story-specific artwork is embedded in downloads and shared readers.
export function editionArtwork(story:Story){return artworkPath(story);}
