import { Shell } from './components/Shell';
import { useRoute } from './navigation';
import { BackupsPage } from './pages/BackupsPage';
import { CalculatorPage } from './pages/CalculatorPage';
import { LoansPage, type LoansSection } from './pages/LoansPage';
import { SalaryPage, type SalarySection } from './pages/SalaryPage';
import { ServicePage } from './pages/ServicePage';

export function App() {
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
    case 'service':
      page = <ServicePage />;
      break;
    case 'backups':
      page = <BackupsPage />;
      break;
    default:
      page = <SalaryPage section={route.section.id as SalarySection} />;
  }

  // key: при смене раздела страница монтируется заново — без «застрявших» результатов прошлого раздела.
  return (
    <Shell route={route}>
      <div key={key}>{page}</div>
    </Shell>
  );
}
