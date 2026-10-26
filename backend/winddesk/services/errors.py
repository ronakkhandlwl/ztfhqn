"""Service-level errors, mapped to HTTP status codes by the API layer."""


class ServiceError(Exception):
    """Base class for expected, user-facing errors."""


class NotFoundError(ServiceError):
    pass


class InvalidRequestError(ServiceError):
    pass
