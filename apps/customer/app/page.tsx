import { ActiveOrderCard } from "../components/home/ActiveOrderCard";
import { Greeting } from "../components/home/Greeting";
import { OrderTypeCards } from "../components/home/OrderTypeCards";
import { RecentLists } from "../components/home/RecentLists";

export default function HomePage() {
  return (
    <div className="space-y-5 px-4 pb-6 pt-2">
      <Greeting />
      <OrderTypeCards />
      <ActiveOrderCard />
      <RecentLists />
    </div>
  );
}
