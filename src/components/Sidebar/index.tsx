import {
  LayoutDashboard,
  Grid,
  Home,
  LogOut,
  PieChart,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import taskFlowLogo from "../../assets/images/Task Flow.png";

const Sidebar = () => {
  const { signOut } = useAuth();
  const navLinks = [
    {
      title: "Home",
      icon: <Home color="#555" size={22} />,
      to: "/home",
    },
    {
      title: "Boards",
      icon: <LayoutDashboard color="#555" size={22} />,
      to: "/boards",
    },
    {
      title: "Projects",
      icon: <Grid color="#555" size={22} />,
      to: "/projects",
    },
    {
      title: "Analytics",
      icon: <PieChart color="#555" size={22} />,
      to: "/analytics",
    },
  ];
  return (
    <div className="fixed left-0 top-0 md:w-[230px] w-[60px] overflow-hidden h-full flex flex-col">
      <div className="w-full flex items-center md:justify-start justify-center md:pl-5 h-[70px] bg-[#fff]">
        <img
          src={taskFlowLogo}
          alt="Task Flow"
          className="md:w-[150px] w-[42px] md:h-[42px] h-[42px] object-contain"
        />
      </div>
      <div className="w-full h-[calc(100vh-70px)] border-r flex flex-col md:items-start items-center gap-2 border-slate-300 bg-[#fff] py-5 md:px-3 px-3 relative">
        {navLinks.map((link) => {
          return (
            <NavLink
              key={link.title}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-2 w-full rounded-lg hover:bg-orange-300 px-2 py-3 cursor-pointer ${
                  isActive ? "bg-orange-300" : "bg-transparent"
                }`
              }
            >
              {link.icon}
              <span className="font-medium text-[15px] md:block hidden">
                {link.title}
              </span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={signOut}
          className="flex absolute bottom-4 items-center md:justify-start justify-center gap-2 md:w-[90%] w-[70%] rounded-lg hover:bg-orange-300 px-2 py-3 cursor-pointer bg-gray-200"
        >
          <LogOut color="#555" size={22} />
          <span className="font-medium text-[15px] md:block hidden">
            Log Out
          </span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
