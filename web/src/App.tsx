import { NavLink, Route, Routes } from "react-router-dom";
import { EngagementList } from "./pages/EngagementList";
import { EngagementPage } from "./pages/EngagementPage";
import { NewOpportunity } from "./pages/NewOpportunity";

export function App() {
  return (
    <div className="shell">
      <aside className="rail">
        <div className="logo">Buyers desk</div>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Engagements
          </NavLink>
          <NavLink to="/new">New opportunity</NavLink>
        </nav>
        <p className="rail-note">Local workspace · synthetic material only</p>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<EngagementList />} />
          <Route path="/new" element={<NewOpportunity />} />
          <Route path="/engagements/:id" element={<EngagementPage />} />
          <Route path="*" element={<p className="muted">Nothing here.</p>} />
        </Routes>
      </main>
    </div>
  );
}
