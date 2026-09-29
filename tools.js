// tools.js
// Define what the agent is ALLOWED to do, and the real code that runs
// when it decides to do it.

export const tools = [
  {
    name: "search_notes",
    description:
      "Search Culy Contracting's internal FAQ/knowledge base for specific info on services, area, process, or policy.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for" },
      },
      required: ["query"],
    },
  },
  {
    name: "capture_lead",
    description:
      "Save a potential customer's contact info and job description when they ask for a quote or want to book work. Always confirm the details back to the customer after calling this.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Customer's name" },
        phone: { type: "string", description: "Customer's phone number" },
        job_description: { type: "string", description: "What they need done, and any details like location or timeline" },
      },
      required: ["name", "phone", "job_description"],
    },
  },
];

// Culy Contracting knowledge base -- pulled from their public site.
const NOTES = [
  { id: 1, text: "Culy Contracting has been in business since 1978, headquartered in Winchester, Indiana, with additional shops in Saratoga IN, Richmond IN, Indianapolis IN, and Morristown TN." },
  { id: 2, text: "Utilities Division services: water, sanitary sewer, and storm sewer underground utility installation, site grading, and concrete work." },
  { id: 3, text: "Protective Coatings Division services: manhole rehabilitation using Mainstay epoxy liner, and special coatings." },
  { id: 4, text: "Flow Control Division services: line stops, bypasses, insert valves, and hot taps." },
  { id: 5, text: "Vac Truck / CCTV Division services: hydro excavation, CCTV sewer line inspection and televising, jet-vac sewer and storm line cleaning, trenchless internal pipe repairs, and root cutting." },
  { id: 6, text: "Other services: manhole and sewer vacuum testing, low pressure air testing, lift station installation and custom fabrication, concrete coring from 3 to 16 inches, and injection grout sealing for pressure leaks." },
  { id: 7, text: "Service area is primarily the Midwest: Indiana, Ohio, Illinois, Kentucky, and Michigan, with an expanding Southeast presence for manhole rehabilitation and flow control out of Morristown, Tennessee." },
  { id: 8, text: "Culy Contracting primarily serves municipalities, utilities, developers, and commercial/industrial clients." },
  { id: 9, text: "Culy offers 24-hour emergency service for urgent water and sewer issues, in addition to standard Monday-Friday 7am-5pm office hours." },
  { id: 10, text: "Culy Contracting has a 4.4-star average across 57 customer reviews on Google and Facebook, and holds an A+ Better Business Bureau rating." },
  { id: 11, text: "The main office phone number is (765) 584-8509." },
];

const leads = [];

export async function executeTool(name, input) {
  switch (name) {
    case "search_notes": {
      const q = input.query.toLowerCase();
      const matches = NOTES.filter((n) => n.text.toLowerCase().includes(q));
      return { matches: matches.length ? matches : "no matches found" };
    }

    case "capture_lead": {
      const lead = {
        ...input,
        capturedAt: new Date().toISOString(),
      };
      leads.push(lead);
      console.log("NEW LEAD CAPTURED:", lead);
      return { confirmed: true, ...input };
    }

    default:
      return { error: `unknown tool: ${name}` };
  }
}
