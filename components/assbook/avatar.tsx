export function Avatar({
  person,
  large = false,
}: {
  person?: { avatar?: string | null; handle?: string };
  large?: boolean;
}) {
  const size = large ? 76 : 43;
  return (
    <span className={"avatar " + (large ? "large" : "")}>
      {person?.avatar ? (
        <img
          src={person.avatar}
          alt={(person.handle ?? "This person") + "’s fully clothed profile photo"}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span aria-hidden="true">
          {person?.handle === "jeanclaude" ? "🩳" : "👖"}
        </span>
      )}
    </span>
  );
}
