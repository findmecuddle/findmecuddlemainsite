import Link from "next/link";
import type { AgencyEmployee } from "@/lib/schema";
import EmployeeCard from "./EmployeeCard";

// Agency-only dashboard section — lists the current roster and lets the agency owner add/edit/remove
// team members, all from their single login (see the schema.ts comment on accountType). Server
// component: the employee list itself is just a prop, each EmployeeCard handles its own
// add/edit/remove state client-side.
export default function TeamManager({
  employees,
  employeeLimit,
}: {
  employees: AgencyEmployee[];
  employeeLimit: number;
}) {
  const atLimit = employeeLimit > 0 && employees.length >= employeeLimit;

  return (
    <div className="card grid gap-4 p-6">
      <div>
        <h2 className="font-display text-lg font-semibold">
          Your Team {employeeLimit > 0 && <span className="text-stone2">({employees.length}/{employeeLimit})</span>}
        </h2>
        <p className="mt-1 text-sm text-stone2">
          Add each cuddler who works at your agency: their photo, hours, and cuddle types show up
          on your public listing.
        </p>
      </div>

      {employeeLimit === 0 && (
        <p className="rounded-lg bg-porcelain px-3 py-2.5 text-sm text-stone2">
          <Link href="#listing-plan" className="font-medium text-spruce hover:underline">
            Subscribe to a Agency plan below
          </Link>{" "}
          to start adding team members.
        </p>
      )}

      {employees.length > 0 && (
        <div className="grid gap-2">
          {employees.map((e) => (
            <EmployeeCard key={e.id} employee={e} />
          ))}
        </div>
      )}

      {employeeLimit > 0 &&
        (atLimit ? (
          <p className="text-xs text-stone2">
            You've reached your plan's limit of {employeeLimit} team members. Upgrade to Large Agency to add more.
          </p>
        ) : (
          <EmployeeCard />
        ))}
    </div>
  );
}
