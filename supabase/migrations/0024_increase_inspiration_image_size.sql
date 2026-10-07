-- High-quality customer references need more headroom than the original 10 MB cap.
-- The bucket remains private and retains its strict image-only upload policies.
update storage.buckets
set file_size_limit = 20971520
where id = 'inspiration-photos';
