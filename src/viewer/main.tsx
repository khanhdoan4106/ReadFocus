import { render } from 'preact';
import { App } from './App';
import { applyTheme, readCachedTheme } from './theme';
import './styles.css';

applyTheme(readCachedTheme());

const root = document.getElementById('app');
if (!root) {
  throw new Error('Không tìm thấy phần tử gốc #app');
}

render(<App />, root);
