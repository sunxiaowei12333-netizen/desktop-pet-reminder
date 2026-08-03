import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  CircleCheckBig,
  Clock3,
  Ellipsis,
  FileText,
  House,
  Inbox,
  LayoutGrid,
  Lightbulb,
  Moon,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  X,
} from "lucide-react";

function makeIcon(Icon) {
  return function LinearIcon(props) {
    return <Icon aria-hidden="true" strokeWidth={1.8} {...props} />;
  };
}

export const Add24Regular = makeIcon(Plus);
export const Apps24Regular = makeIcon(LayoutGrid);
export const ArrowRight24Regular = makeIcon(ArrowRight);
export const ArrowSync24Regular = makeIcon(RefreshCw);
export const CalendarLtr24Regular = makeIcon(CalendarDays);
export const CheckmarkCircle24Filled = makeIcon(CircleCheckBig);
export const Clock24Regular = makeIcon(Clock3);
export const DataTrending24Regular = makeIcon(ChartNoAxesCombined);
export const Dismiss24Regular = makeIcon(X);
export const Document24Regular = makeIcon(FileText);
export const Edit24Regular = makeIcon(Pencil);
export const Home24Regular = makeIcon(House);
export const Inbox24Regular = makeIcon(Inbox);
export const Lightbulb24Regular = makeIcon(Lightbulb);
export const MoreHorizontal24Regular = makeIcon(Ellipsis);
export const PanelLeft24Regular = makeIcon(PanelLeft);
export const Search24Regular = makeIcon(Search);
export const Send24Regular = makeIcon(Send);
export const Settings24Regular = makeIcon(Settings);
export const Sparkle24Regular = makeIcon(Sparkles);
export const WeatherMoon24Regular = makeIcon(Moon);
export const WeatherSunny24Regular = makeIcon(Sun);
