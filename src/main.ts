import { mount } from 'svelte';
import './app.css';
import App from './ui/App.svelte';
import { store } from './ui/store.svelte';

const app = mount(App, { target: document.getElementById('app')! });

// Dev-only: lets the browser console (and automated checks) drive the UI store.
if (import.meta.env.DEV) (window as unknown as { __store: typeof store }).__store = store;

export default app;
