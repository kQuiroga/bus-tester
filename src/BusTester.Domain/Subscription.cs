namespace BusTester.Domain;

public sealed class Subscription
{
    public SubscriptionHandle Handle { get; }
    public string QueueName { get; }

    public Subscription(string queueName)
    {
        if (string.IsNullOrWhiteSpace(queueName))
        {
            throw new ArgumentException("Queue name is required.", nameof(queueName));
        }

        QueueName = queueName;
        Handle = new SubscriptionHandle(Guid.NewGuid());
    }
}
