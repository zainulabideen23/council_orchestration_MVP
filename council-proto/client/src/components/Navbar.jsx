import { NavLink } from 'react-router-dom'

const linkClass = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-blue-600 text-white'
      : 'text-gray-700 hover:bg-gray-200'
  }`

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="font-bold text-lg text-blue-900">
          Council Orchestration Console
        </span>
        <div className="flex gap-2">
          <NavLink to="/agents" className={linkClass}>
            Agent Library
          </NavLink>
          <NavLink to="/roadmap" className={linkClass}>
            Roadmap Builder
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
