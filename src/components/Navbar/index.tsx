import {
  ChevronDown,
  Bell,
  UserCircle,
  Search,
  Settings,
  Share2,
} from "lucide-react";

const Navbar = () => {
  return (
    <div className="md:w-[calc(100%-230px)] w-[calc(100%-60px)] fixed flex items-center justify-between pl-2 pr-6 h-[70px] top-0 md:left-[230px] left-[60px] border-b border-slate-300 bg-[#fff]">
      <div className="flex items-center gap-3 cursor-pointer">
        <UserCircle color="#fb923c" size={28} />
        <span className="text-orange-400 font-semibold md:text-lg text-sm whitespace-nowrap">
          Board Name
        </span>
        <ChevronDown color="#fb923c" size={16} />
      </div>
      <div className="md:w-[800px] w-[130px] bg-gray-100 rounded-lg px-3 py-[10px] flex items-center gap-2">
        <Search color={"#999"} size={20} />
        <input
          type="text"
          placeholder="Search"
          className="w-full bg-gray-100 outline-none text-[15px]"
        />
      </div>
      <div className="md:flex hidden items-center gap-4">
        <div className="grid place-items-center bg-gray-100 rounded-full p-2 cursor-pointer">
          <Share2 color={"#444"} size={20} />
        </div>
        <div className="grid place-items-center bg-gray-100 rounded-full p-2 cursor-pointer">
          <Settings color={"#444"} size={20} />
        </div>
        <div className="grid place-items-center bg-gray-100 rounded-full p-2 cursor-pointer">
          <Bell color={"#444"} size={20} />
        </div>
      </div>
    </div>
  );
};

export default Navbar;
