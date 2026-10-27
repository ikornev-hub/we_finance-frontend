import { Shell } from './components/Shell';
import { useRoute } from './navigation';
import { ExpensesPage, type ExpensesSection } from './pages/ExpensesPage';
import { CinemaPage } from './pages/CinemaPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { useToken } from './lib/session';
import { CalculatorPage } from './pages/CalculatorPage';
import { IncomePage, type IncomeSection } from './pages/IncomePage';
import { LoansPage, type LoansSection } from './pages/LoansPage';
import { ServicePage } from './pages/ServicePage';

export function App() {
  const token = useToken();
  if (!token) return <LoginPage />;
  return <SignedIn />;
}

function SignedIn() {
  const route = useRoute();
  const key = `${route.tab.id}/${route.section.id}/${route.param ?? ''}`;

  let page;
  switch (route.tab.id) {
    case 'loans':
      page = <LoansPage section={route.section.id as LoansSection} param={route.param} />;
      break;
    case 'calculator':
      page = <CalculatorPage />;
      break;
    case 'income':
      page = <IncomePage section={route.section.id as IncomeSection} />;
      break;
    case 'expenses':
      page = <ExpensesPage section={route.section.id as ExpensesSection} />;
      break;
    case 'system':
      page = <ServicePage />;
      break;
    default:
      page = route.section.id === 'cinema' ? <CinemaPage /> : <HomePage />;
  }

  // key: при смене раздела страница монтируется заново — без «застрявших» результатов прошлого раздела.
  return (
    <Shell route={route}>
      <div key={key}>{page}</div>
    </Shell>
  );
}
