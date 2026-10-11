// Server-only assets. Browser previews load the selected image as a separate file.
import memories from '../public/artwork/memories.jpg';
import together from '../public/artwork/together.jpg';
import journey from '../public/artwork/journey.jpg';
import {chosenArtwork} from './artwork';
import {type Story} from './story';
export const artworkData={memories,together,journey};
export function editionArtwork(story:Story){const key=chosenArtwork(story);if(key==='generated')return story.generatedArt?.data;return !story.photo&&key!=='none'?artworkData[key]:undefined;}
