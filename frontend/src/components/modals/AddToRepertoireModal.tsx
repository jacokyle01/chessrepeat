import React, { useRef, useState } from 'react';
import { closeI } from '../../svg/close'; // adjust import path if needed
import { CircleXIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';

const AddToReperotireModal: React.FC = ({ importToRepertoire }) => {
  const setShowModal = useTrainerStore((s) => s.setShowingAddToRepertoireMenu);
  const [selectedColor, setSelectedColor] = useState(undefined);
  const nameRef = useRef<HTMLInputElement>(null);
  const pgnRef = useRef<HTMLTextAreaElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const annotatedRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    console.log('handle submit');
    e.preventDefault();

    const name = nameRef.current?.value || '';
    const pgn = pgnRef.current?.value || '';
    const color = colorRef.current?.checked ? 'white' : 'black';
    importToRepertoire(pgn, color, name);
    setShowModal(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (pgnRef.current) {
          pgnRef.current.value = reader.result as string;
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <dialog
      open
      className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 border-none bg-white rounded-lg shadow-lg w-full max-w-lg"
    >
      {/* Close button */}
      <button
        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full h-8 w-8 flex items-center justify-center shadow-md hover:bg-red-600"
        aria-label="Close"
        // onClick={() => TODO}
      >
        <CircleXIcon className="w-5 h-5" />
      </button>

      {/* Heading */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">Add to Repertoire</h2>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6">
        {/* Name */}
        <div className="mb-4">
          <label className="block text-gray-700 text-base font-semibold mb-2">Name</label>
          <input
            id="name"
            ref={nameRef}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>

        {/* PGN */}
        <div className="mb-4">
          <label className="block text-gray-700 text-base font-semibold mb-2">PGN</label>
          <textarea
            id="pgn"
            ref={pgnRef}
            rows={4}
            placeholder="Enter PGN...\nex. 1. d4 d5 2. c4 c6"
            className="shadow block w-full text-sm text-gray-700 rounded-lg border border-gray-300 p-3"
          />
          <input
            id="fileInput"
            type="file"
            accept=".txt,.pgn"
            onChange={handleFileChange}
            className="mt-2 text-sm"
          />
        </div>

        {/* Train As */}
        <div className="mb-5">
          <label className="block text-gray-700 text-base font-semibold mb-3">Train as</label>
          <div className="flex">
            <label className="flex-1">
              <input
                id="colorWhite"
                ref={colorRef}
                type="radio"
                name="color"
                value="white"
                className="hidden peer"
                onChange={() => setSelectedColor('white')}
              />
              <span className="block text-center py-3 text-lg font-medium bg-gray-200 text-gray-800 rounded-l-lg peer-checked:bg-gray-700 peer-checked:text-white cursor-pointer transition">
                White
              </span>
            </label>
            <label className="flex-1">
              <input
                id="colorBlack"
                type="radio"
                name="color"
                value="black"
                className="hidden peer"
                onChange={() => setSelectedColor('black')}
              />
              <span className="block text-center py-3 text-lg font-medium bg-gray-200 text-gray-800 rounded-r-lg peer-checked:bg-gray-700 peer-checked:text-white cursor-pointer transition">
                Black
              </span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={`w-full text-lg font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition ${
            selectedColor
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Add
        </button>
      </form>
    </dialog>
  );
};

export default AddToReperotireModal;
