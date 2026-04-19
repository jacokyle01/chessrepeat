import React from 'react';
import Chessrepeat from './Chessrepeat';
import { LoginModal } from './components/modals/LoginModal';

const App: React.FC = () => {
  return (
    <main className="flex justify-center items-center h-screen">
      <Chessrepeat />
      <LoginModal />
    </main>
  );
};

export default App;
