import {
  Home,
  LogOut,
  PieChart,
  Grid,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useProjects } from "../../context/useProjects";
import taskFlowLogo from "../../assets/images/Task Flow.png";
import taskFlowMiniLogo from "../../assets/images/Task Flow-Mini.png";

const Sidebar = () => {
  const { signOut } = useAuth();
  const { activeProjectId } = useProjects();
  const navLinks = [
    {
      title: "Home",
      icon: <Home color="#555" size={22} />,
      to: "/home",
    },
    {
      title: "Projects",
      icon: <Grid color="#555" size={22} />,
      to: "/projects",
    },
    {
      title: "Analytics",
      icon: <PieChart color="#555" size={22} />,
      to: activeProjectId ? `/analytics/${activeProjectId}` : "/analytics",
    },
  ];
  return (
    <div className="fixed left-0 top-0 md:w-[230px] w-[60px] overflow-hidden h-full flex flex-col">
      <div className="w-full flex items-center md:justify-start justify-center md:pl-5 h-[70px] bg-white border-r border-slate-200">
        <img
          src={taskFlowLogo}
          alt="Task Flow"
          className="hidden md:block w-[150px] h-[42px] object-contain"
        />
        <img
          src={taskFlowMiniLogo}
          alt="Task Flow"
          className="md:hidden block w-[42px] h-[42px] object-contain"
        />
      </div>
      <div className="w-full h-[calc(100vh-70px)] border-r flex flex-col md:items-start items-center gap-2 border-slate-200 bg-white py-5 md:px-3 px-3 relative">
        {navLinks.map((link) => {
          return (
            <NavLink
              key={link.title}
              to={link.to}
              className={({ isActive }) =>
                `group flex items-center gap-2 w-full rounded-xl px-2 py-3 cursor-pointer transition ${
                  isActive
                    ? "bg-orange-100 text-orange-900"
                    : "bg-transparent hover:bg-slate-100 text-slate-700"
                }`
              }
            >
              <span className="group-hover:opacity-90">{link.icon}</span>
              <span className="font-semibold text-[15px] md:block hidden">
                {link.title}
              </span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={signOut}
          className="flex absolute bottom-4 items-center md:justify-start justify-center gap-2 md:w-[92%] w-[70%] rounded-xl hover:bg-slate-100 px-2 py-3 cursor-pointer bg-slate-100 text-slate-700 border border-slate-200"
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
