import { ActiveOrderCard } from "../components/home/ActiveOrderCard";
import { Greeting } from "../components/home/Greeting";
import { RecentLists } from "../components/home/RecentLists";
import { SendListCard } from "../components/home/SendListCard";
import { TrustChips } from "../components/home/TrustChips";

export default function HomePage() {
  return (
    <div className="space-y-5 px-4 pb-6 pt-2">
      <Greeting />
      <SendListCard />
      <TrustChips />
      <ActiveOrderCard />
      <RecentLists />
    </div>
  );
}
