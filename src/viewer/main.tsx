import { render } from 'preact';
import { vi } from '../i18n/vi';
import './styles.css';

function App() {
  return (
    <main class="empty">
      <h1>{vi.appName}</h1>
      <p class="empty__title">{vi.emptyTitle}</p>
      <p class="empty__hint">{vi.emptyHint}</p>
    </main>
  );
}

const root = document.getElementById('app');
if (!root) {
  throw new Error('Không tìm thấy phần tử gốc #app');
}

render(<App />, root);
