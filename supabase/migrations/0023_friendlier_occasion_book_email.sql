-- Keep the Occasion Book confirmation warm, useful and explicit about what
-- saving a date does. The customer can reply directly into the Message Centre.
update public.message_templates
set body = $template$
<div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.7;color:#2a2722;max-width:560px"><p>Hi {{first_name}},</p><p>Lovely, it is safely saved. I have added {{person_name}}'s {{occasion_type}} on {{occasion_date}} to your Occasion Book.</p><p>Here is how it works. I will send you a friendly reminder one month, two weeks and one week before the date. That gives you plenty of time to decide whether you would like a cake.</p><p>Saving the date is completely free. It does not book a cake, and there is nothing to pay.</p><p>You can change or remove the date from your account whenever you like. You are also very welcome to reply to this email and I will be happy to help.</p><p>Warmly,<br>Hazel</p></div>
$template$
where template_name = 'circle_member_added';
