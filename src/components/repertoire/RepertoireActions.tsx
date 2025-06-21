import { BookDownIcon, BookPlus } from 'lucide-react';
import { useTrainerStore } from '../../state/state';

const RepertoireActions: React.FC = () => {
  const setShowingAddToRepertoireMenu = useTrainerStore((state) => state.setShowingAddToRepertoireMenu);

  return (
    <div id="repertoire-actions" className="my-2 flex flex-wrap justify-center gap-2">
      <button
        onClick={() => setShowingAddToRepertoireMenu(true)}
        className="flex items-center justify-center bg-blue-500 text-white font-semibold rounded-md py-2 px-2 min-w-[180px] gap-2 transition duration-200 ease-in-out hover:bg-blue-600 active:scale-95 shadow-md hover:shadow-lg"
      >
        <BookPlus className="w-5 h-5" />
        <span>Add to Repertoire</span>
      </button>

      <button
        // onClick={() => ctrl.downloadRepertoire()}
        className="flex items-center justify-center bg-blue-700 text-white font-semibold rounded-md py-2 px-2 min-w-[160px] gap-2 transition duration-200 ease-in-out hover:bg-blue-800 active:scale-95 shadow-md hover:shadow-lg"
      >
        <BookDownIcon className="w-5 h-5" />
        <span>Download</span>
      </button>
    </div>
  );
};

export default RepertoireActions;
