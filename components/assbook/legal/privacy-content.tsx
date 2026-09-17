// Privacy notice. Plain language, and only what the service actually does.
export function PrivacyContent() {
  return (
    <>
      <p>
        This notice explains what Assbook collects, why, and what happens to it.
        Assbook is operated from Serbia and hosted on Cloudflare. If something
        here is unclear, write to hello@assbook.app.
      </p>
      <h2>What we collect</h2>
      <p>
        <strong>Account details.</strong> Your handle, display name, bio, an
        optional website link, and a hashed password. Your email address, once
        verified, is used for account recovery and is never shown on your
        profile.
      </p>
      <p>
        <strong>Content.</strong> Posts, replies, likes, bookmarks, follows,
        blocks, reports and the photos you upload.
      </p>
      <p>
        <strong>Technical data.</strong> Your IP address is used for rate
        limiting and abuse prevention and appears in short-lived server logs. A
        session cookie keeps you signed in for seven days. We do not use
        advertising or analytics trackers.
      </p>
      <h2>Photos and the automatic check</h2>
      <p>
        Every photo you upload is checked by an image model running on
        Cloudflare Workers AI before it is stored, to enforce the dress code.
        The photo is not sent to any other company and is not used to train
        models. Photos the check is unsure about are stored and reviewed by a
        moderator, who can see any stored photo for that purpose. Photos are
        stored as uploaded; we do not currently remove camera metadata such as
        location, so strip it yourself if that matters to you.
      </p>
      <h2>How we use your data</h2>
      <p>
        To run the service: showing your profile and posts to other members,
        delivering account emails, keeping you signed in, preventing abuse, and
        moderating content. We do not sell data and we do not share it with
        advertisers.
      </p>
      <h2>Who else sees it</h2>
      <p>
        Cloudflare hosts the application, the database, photo storage and email
        sending, and processes data on our behalf under its own terms. Nobody
        else receives your data unless the law requires it.
      </p>
      <h2>How long we keep it</h2>
      <p>
        Content stays until you delete it or your account is removed. Deleted
        posts are hidden immediately and their photos are removed from storage
        when nothing else uses them. Uploaded photos that never become a post or
        profile photo are deleted after a day. Expired sessions and recovery
        links are cleared automatically. Server logs are kept for a short period
        for security.
      </p>
      <h2>Your rights</h2>
      <p>
        You can edit your profile, delete your posts and replies, remove your
        photo, and change your email or password from Account security. To
        delete your account entirely or to get a copy of your data, email
        accounts@assbook.app from your verified address and we will handle it
        within 30 days. Self-service account deletion is on the way.
      </p>
      <h2>Children</h2>
      <p>
        Assbook is for people 18 and older. We do not knowingly collect data
        from anyone younger, and we remove such accounts when we learn of them.
      </p>
      <h2>Changes</h2>
      <p>
        If this notice changes in a way that matters, the official account will
        say so and the date below will move.
      </p>
      <p>Last updated: 17 September 2026.</p>
    </>
  );
}
