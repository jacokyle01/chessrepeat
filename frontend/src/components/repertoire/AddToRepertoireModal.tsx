import React, { useRef } from 'react';
import { closeI } from '../../svg/close'; // adjust import path if needed
import { CircleXIcon } from 'lucide-react';

type Props = {
  ctrl: any; // TODO: replace with actual PrepCtrl type
};

const AddToReperotireModal: React.FC<Props> = ({ importToRepertoire }) => {
  const nameRef = useRef<HTMLInputElement>(null);
  const pgnRef = useRef<HTMLTextAreaElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const annotatedRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const name = nameRef.current?.value || '';
    const pgn = pgnRef.current?.value || '';
    const color = colorRef.current?.checked ? 'black' : 'white';
    const annotated = annotatedRef.current?.checked;

    if (!annotated) {
      console.log('annotated!');
      // ctrl.importAnnotatedChapter(pgn);
    } else {
      // ctrl.addToRepertoire(pgn, color, name);
      importToRepertoire(pgn, color, name);
    }
    // TODO
    // ctrl.toggleAddingNewSubrep();
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
      className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 border-none"
    >
      <button
        // onClick={() =>  TODO as separate action}
        className="bg-red-500 rounded-full h-6 w-6 flex items-center justify-center absolute top-1 right-1"
      >
        <CircleXIcon />
      </button>

      <form onSubmit={handleSubmit} className="p-8 bg-white rounded-md shadow-md">
        <div className="mb-2">
          <label className="block text-gray-700 text-sm font-bold mb-2">Name</label>
          <input
            id="name"
            ref={nameRef}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>

        <div className="mb-3">
          <label className="block text-gray-700 text-sm font-bold mb-2">PGN</label>
          <textarea
            id="pgn"
            ref={pgnRef}
            rows={4}
            placeholder="Enter PGN...\nex. 1. d4 d5 2. c4 c6"
            className="shadow block w-full text-sm text-gray-700 rounded-lg border border-gray-300 p-3"
          />
          <input id="fileInput" type="file" accept=".txt,.pgn" onChange={handleFileChange} />
        </div>

        <div className="mb-5">
          <label className="block text-gray-700 text-sm font-bold mb-2">Train As</label>
          <label htmlFor="color" className="inline-flex items-center rounded-md cursor-pointer text-gray-100">
            <input id="color" ref={colorRef} type="checkbox" className="hidden peer" />
            <span className="px-4 rounded-l-md bg-gray-700 peer-checked:bg-gray-300">White</span>
            <span className="px-4 rounded-r-md bg-gray-300 peer-checked:bg-gray-700">Black</span>
          </label>
        </div>

        <div className="mb-5">
          <label className="block text-gray-700 text-sm font-bold mb-2">Repertoire is annotated?</label>
          <label
            htmlFor="annotated"
            className="inline-flex items-center rounded-md cursor-pointer text-gray-100"
          >
            <input id="annotated" ref={annotatedRef} type="checkbox" className="hidden peer" />
            <span className="px-4 rounded-l-md bg-gray-700 peer-checked:bg-gray-300">Yes</span>
            <span className="px-4 rounded-r-md bg-gray-300 peer-checked:bg-gray-700">No</span>
          </label>
        </div>

        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Add
        </button>
      </form>
    </dialog>
  );
};

export default AddToReperotireModal;
