import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="w-full flex items-center justify-center py-10">
      <div className="bg-white rounded-lg p-6 shadow-sm flex flex-col gap-3 items-start">
        <div className="text-xl font-bold text-gray-800">404</div>
        <div className="text-sm text-gray-600">Page not found.</div>
        <Link
          to="/boards"
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-400 text-white font-medium hover:bg-orange-500"
        >
          Go to Boards
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

