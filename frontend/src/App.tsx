import React from 'react';
import ChessOpeningTrainer, { Chessrepeat } from './Chessrepeat';
import { AuthProvider } from './contexts/AuthContext';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuthCallback from './state/AuthCallback';

const App: React.FC = () => {
  return (
    <main className="flex justify-center items-center h-screen">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth/google/callback" element={<AuthCallback />} />
            <Route path="/*" element={<Chessrepeat />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </main>
  );
};

export default App;
