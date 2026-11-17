import { NavLink, Route, Routes } from "react-router-dom";
import { EngagementList } from "./pages/EngagementList";
import { EngagementPage } from "./pages/EngagementPage";
import { IntakePage } from "./pages/IntakePage";
import { PipelinePage } from "./pages/PipelinePage";
import { ProfessionalsPage } from "./pages/ProfessionalsPage";
import { TasksPage } from "./pages/TasksPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { PeoplePage } from "./pages/PeoplePage";
import { PersonPage } from "./pages/PersonPage";
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
          <NavLink to="/pipeline">Pipeline</NavLink>
          <NavLink to="/tasks">Tasks</NavLink>
          <NavLink to="/people">Clients</NavLink>
          <NavLink to="/professionals">Professionals</NavLink>
          <NavLink to="/integrations">Integrations</NavLink>
          <NavLink to="/feedback">Feedback</NavLink>
          <NavLink to="/new">New opportunity</NavLink>
        </nav>
        <p className="rail-note">Local workspace · synthetic material only</p>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<EngagementList />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/professionals" element={<ProfessionalsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/people" element={<PeoplePage />} />
          <Route path="/people/:id" element={<PersonPage />} />
          <Route path="/new" element={<NewOpportunity />} />
          <Route path="/engagements/:id" element={<EngagementPage />} />
          <Route path="/intakes/:id" element={<IntakePage />} />
          <Route path="*" element={<p className="muted">Nothing here.</p>} />
        </Routes>
      </main>
    </div>
  );
}
