import { SampleLoader } from './SampleLoader';
import { AudioEngine } from './AudioEngine';
import { WickiHeydenGrid } from './WickiHeydenGrid';

async function main(): Promise<void> {
  const loadingScreen = document.getElementById('loading-screen')!;
  const loadingBar = document.getElementById('loading-bar')!;
  const loadingText = document.getElementById('loading-text')!;

  // Create a temporary AudioContext for decoding
  const tempCtx = new AudioContext({ latencyHint: 'interactive' });

  const loader = new SampleLoader(tempCtx);

  // Load all samples with progress
  const buffers = await loader.loadAll((loaded, total) => {
    const pct = Math.round((loaded / total) * 100);
    loadingBar.style.width = `${pct}%`;
    loadingText.textContent = `${loaded} / ${total} samples loaded`;
  });

  // Close temp context, create the real one
  tempCtx.close();

  // Create the audio engine with loaded buffers
  const engine = new AudioEngine(buffers);

  // Build set of available sample note names
  const sampleNoteNames = new Set(buffers.keys());

  // Hide loading screen
  loadingScreen.classList.add('hidden');

  // Initialize the Wicki-Heyden hexagonal grid
  const container = document.getElementById('piano-container')!;
  new WickiHeydenGrid(container, engine, sampleNoteNames);
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}