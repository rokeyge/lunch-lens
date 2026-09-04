export type MenuProgramId =
  | "elementary-standard"
  | "elementary-bayside"
  | "middle-district"
  | "middle-special-6-8"
  | "preschool";

export interface School {
  id: string;
  name: string;
  programId: MenuProgramId;
  grades: string;
  category: "Elementary Schools" | "Bayside Academy" | "Middle Schools" | "K–8 Programs (Grades 6–8)" | "Preschool";
}

export const SCHOOLS: School[] = [
  // Elementary Schools
  { id: "audubon", name: "Audubon Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "baywood", name: "Baywood Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "beach-park", name: "Beach Park Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "beresford", name: "Beresford Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "brewer-island", name: "Brewer Island Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "college-park", name: "College Park Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "cottage-grove", name: "Cottage Grove Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "foster-city", name: "Foster City Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "george-hall", name: "George Hall Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "highlands", name: "Highlands Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "laurel", name: "Laurel Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "meadow-heights", name: "Meadow Heights Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "san-mateo-park", name: "San Mateo Park Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "sunnybrae", name: "Sunnybrae Elementary School", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },

  // Bayside Academy
  { id: "bayside-elem", name: "Bayside Academy (Grades K–5)", programId: "elementary-bayside", grades: "K–5", category: "Bayside Academy" },
  { id: "bayside-middle", name: "Bayside Academy (Grades 6–8)", programId: "middle-district", grades: "6–8", category: "Bayside Academy" },

  // Middle Schools
  { id: "abbott", name: "Abbott Middle School", programId: "middle-district", grades: "6–8", category: "Middle Schools" },
  { id: "borel", name: "Borel Middle School", programId: "middle-district", grades: "6–8", category: "Middle Schools" },
  { id: "bowditch", name: "Bowditch Middle School", programId: "middle-district", grades: "6–8", category: "Middle Schools" },

  // K–8 Programs (Grades K–5 use elementary standard, 6–8 use special 6–8 menu)
  { id: "fiesta-gardens-elem", name: "Fiesta Gardens International (Grades K–5)", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "fiesta-gardens-6-8", name: "Fiesta Gardens International (Grades 6–8)", programId: "middle-special-6-8", grades: "6–8", category: "K–8 Programs (Grades 6–8)" },
  { id: "north-shoreview-elem", name: "North Shoreview Montessori (Grades K–5)", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "north-shoreview-6-8", name: "North Shoreview Montessori (Grades 6–8)", programId: "middle-special-6-8", grades: "6–8", category: "K–8 Programs (Grades 6–8)" },
  { id: "parkside-elem", name: "Parkside Montessori (Grades K–5)", programId: "elementary-standard", grades: "K–5", category: "Elementary Schools" },
  { id: "parkside-6-8", name: "Parkside Montessori (Grades 6–8)", programId: "middle-special-6-8", grades: "6–8", category: "K–8 Programs (Grades 6–8)" },

  // Preschool
  { id: "turnbull", name: "Turnbull Child Development Center", programId: "preschool", grades: "Preschool", category: "Preschool" }
];

export const DEFAULT_SCHOOL_ID = "audubon";

export const getSchool = (id: string): School => {
  return SCHOOLS.find((s) => s.id === id) || SCHOOLS[0];
};
