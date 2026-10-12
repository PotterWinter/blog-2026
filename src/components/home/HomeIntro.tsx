import { Keep } from "./Hero";

// The serif line beside the home hero. Settings (09) shows this same line, so there's
// one copy to change (5.5b moves it into site.json).
export default function HomeIntro() {
  return (
    <>
      Architecture taught me how things are <Keep>put together.</Keep> Software is where{" "}
      <Keep>I build them.</Keep> This is the place I keep notes along the way on what I make,
      what I read, and <Keep>what finally made sense.</Keep>
    </>
  );
}
