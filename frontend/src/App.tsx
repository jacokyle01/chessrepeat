import React from 'react';
import Chessrepeat from './Chessrepeat';
import Login from './Login';
import { useAuthStore } from './store/auth';

const App: React.FC = () => {
  const showLogin = useAuthStore((s) => s.showLogin);
  return (
    <main className="flex justify-center items-center h-screen">
      {showLogin ? <Login /> : <Chessrepeat />}
    </main>
  );
};

export default App;
