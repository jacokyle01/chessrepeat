import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ChessOpeningTrainer from './Chessrepeat';
import Login from './Login';

const App: React.FC = () => {
  return (
    <main className="flex justify-center items-center h-screen">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/@/:username" element={<ChessOpeningTrainer />} />
        <Route path="*" element={<ChessOpeningTrainer />} />
      </Routes>
    </main>
  );
};

export default App;
