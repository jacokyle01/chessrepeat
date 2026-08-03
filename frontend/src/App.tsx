import React from 'react';
import Chessrepeat from './Chessrepeat';
import { LoginModal } from './components/modals/LoginModal';

const App: React.FC = () => {
  return (
    <main className="app-shell">
      <Chessrepeat />
      <LoginModal />
    </main>
  );
};

export default App;
