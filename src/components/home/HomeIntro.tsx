import { Keep } from "./Hero";

// The serif line beside the home hero. Settings (09) shows this same line, so there's
// one copy to change (5.5b moves it into site.json).
export default function HomeIntro() {
  return (
    <>
      I graduated in architecture, <Keep>ended up</Keep> building software, and write here
      about how things are <Keep>put together.</Keep> This is <Keep>a notebook,</Keep>{" "}
      <Keep>not a publication.</Keep> Posts go up when something breaks and{" "}
      <Keep>I finally understand why.</Keep>
    </>
  );
}
