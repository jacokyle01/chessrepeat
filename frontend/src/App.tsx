import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ChessOpeningTrainer from './Chessrepeat';

const App: React.FC = () => {
  return (
    <main className="flex justify-center items-center h-screen">
      <Routes>
        <Route path="/@/:username" element={<ChessOpeningTrainer />} />
        <Route path="*" element={<ChessOpeningTrainer />} />
      </Routes>
    </main>
  );
};

export default App;
